"""Use the existing deployment fixture's test database, never runtime data."""
import unittest
import uuid
import test_deployment as fixture
from backend.database import get_connection
from backend.services.auth_service import create_user


class UserFeaturesTests(unittest.TestCase):
    def setUp(self):
        suffix=uuid.uuid4().hex[:10]
        self.name='user-'+suffix
        self.other_name='other-'+suffix
        self.user=create_user(self.name,self.name+'@example.test','password-123')
        self.other=create_user(self.other_name,self.other_name+'@example.test','password-123')
        self.client=fixture.TestClient(fixture.app,base_url='https://testserver')
        self.addCleanup(self.client.close)

    def login(self,name=None,role='user'):
        return self.client.post('/api/auth/login',json={'identifier':name or self.name,'password':'password-123','role':role})

    def test_login_pages_and_backend_roles(self):
        for path,role in [('/login','user'),('/admin/login','admin')]:
            r=self.client.get(path)
            self.assertEqual(r.status_code,200)
            self.assertIn('data-login-role="'+role+'"',r.text)
            self.assertNotIn('class="role-button',r.text)
        self.assertEqual(self.client.get('/frontend/html/login.html',follow_redirects=False).headers['location'],'/login')
        self.assertEqual(self.login(role='admin').status_code,401)
        with get_connection() as db: db.execute("UPDATE users SET role='admin' WHERE id=?",(self.other['id'],))
        self.assertEqual(self.login(self.other_name,role='user').status_code,401)
        self.assertEqual(self.login(self.other_name,role='admin').status_code,200)
        self.assertEqual(self.client.get('/api/admin/me').status_code,200)
        self.assertEqual(self.client.get('/api/user/profile').status_code,403)

    def test_cart_page_requires_session(self):
        for path in ['/cart.html', '/frontend/html/cart.html']:
            response = self.client.get(path, follow_redirects=False)
            self.assertEqual(response.status_code, 307)
            self.assertEqual(response.headers['location'], '/login')
            self.assertEqual(response.headers['cache-control'], 'no-store')
        self.login()
        self.assertEqual(self.client.get('/frontend/html/cart.html').status_code, 200)
        self.client.post('/api/auth/logout')
        self.assertEqual(self.client.get('/cart.html', follow_redirects=False).status_code, 307)

    def test_quiz_and_content_changes_are_audited(self):
        with get_connection() as db:
            db.execute("UPDATE users SET role='admin' WHERE id=?", (self.other['id'],))
        self.assertEqual(self.login(self.other_name, role='admin').status_code, 200)
        question = {'title': 'Audit question', 'answers': [{'text': 'Dry', 'type': 'dry'}]}
        created = self.client.post('/api/admin/quiz', json=question)
        self.assertEqual(created.status_code, 201)
        qid = created.json()['id']
        self.assertEqual(self.client.put(f'/api/admin/quiz/{qid}', json=question).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/admin/quiz/{qid}').status_code, 200)
        self.assertEqual(self.client.put('/api/admin/content/hero_title', json={'value': 'Hello'}).status_code, 200)
        with get_connection() as db:
            rows = db.execute("SELECT action, entity, entity_id FROM admin_audit_logs WHERE admin_user_id=? ORDER BY id", (self.other['id'],)).fetchall()
        self.assertEqual([tuple(row) for row in rows], [
            ('create', 'quiz_question', str(qid)),
            ('update', 'quiz_question', str(qid)),
            ('delete', 'quiz_question', str(qid)),
            ('update', 'home_content', 'hero_title'),
        ])
        
    def test_product_edits_preserve_fields_and_audit_changes(self):
        with get_connection() as db:
            db.execute("UPDATE users SET role='admin' WHERE id=?", (self.other['id'],))
        self.assertEqual(self.login(self.other_name, role='admin').status_code, 200)
        created = self.client.post('/api/admin/products', json={
            'name': 'Before edit', 'brand': 'Before brand', 'visible': False,
            'ingredients': ['Niacinamide'], 'product_url': 'https://example.test/product'
        })
        self.assertEqual(created.status_code, 201)
        product_id = created.json()['id']
        path = f'/api/admin/products/{product_id}'
        try:
            updated = self.client.put(path, json={'name': 'After edit', 'brand': 'After brand'})
            self.assertEqual(updated.status_code, 200)
            self.assertEqual(updated.json()['ingredients'], ['Niacinamide'])
            self.assertEqual(updated.json()['product_url'], 'https://example.test/product')
            self.assertFalse(updated.json()['visible'])
            self.assertEqual(self.client.get(f'/api/products/{product_id}').status_code, 404)
            logs = self.client.get('/api/admin/audit-logs').json()['logs']
            self.assertEqual(logs[0]['action'], 'update: brand, name')
            self.client.put(path, json={'name': 'After edit'})
            logs = self.client.get('/api/admin/audit-logs').json()['logs']
            self.assertEqual(logs[0]['action'], 'update: no changes')
        finally:
            self.assertEqual(self.client.delete(path).status_code, 200)

    def test_profile_quiz_persistence_and_identity(self):
        self.assertEqual(self.login().status_code,200)
        result={'skinType':'dry','concern':'dryness','inconclusive':False}
        r=self.client.put('/api/user/profile',json={'quiz_result':result})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['skin_profile']['skinType'],'dry')
        self.client.post('/api/auth/logout')
        with fixture.TestClient(fixture.app,base_url='https://testserver') as second_device:
            second_device.post('/api/auth/login',json={'identifier':self.name,'password':'password-123'})
            self.assertEqual(second_device.get('/api/user/profile').json()['quiz_result'],result)
        self.login()
        r=self.client.put('/api/user/profile',json={'username':self.name+'-new','email':self.name+'-new@example.test','skin_profile':{'skinType':'oily','concern':'acne'}})
        self.assertEqual(r.status_code,200)
        self.assertEqual(r.json()['quiz_result'],result)
        self.assertEqual(self.client.get('/api/auth/me').json()['user']['username'],self.name+'-new')
        self.client.post('/api/auth/logout')
        self.assertEqual(self.login(self.name+'-new').status_code,200)
        self.assertEqual(self.client.get('/api/user/profile').json()['skin_profile']['skinType'],'oily')

    def test_guests_ownership_and_validation(self):
        self.assertEqual(self.client.get('/api/user/profile').status_code,401)
        self.assertEqual(self.client.put('/api/user/profile',json={}).status_code,401)
        self.login()
        self.client.put('/api/user/profile',json={'skin_profile':{'skinType':'sensitive'}})
        self.client.post('/api/auth/logout');self.login(self.other_name)
        self.assertIsNone(self.client.get('/api/user/profile',params={'user_id':self.user['id']}).json()['skin_profile'])
        for payload in [{'user_id':self.user['id']},{'role':'admin'},{'username':None},{'username':'  '},{'email':'bad'},{'skin_profile':{'skinType':'invalid'}}]:
            self.assertEqual(self.client.put('/api/user/profile',json=payload).status_code,422)
        self.assertEqual(self.client.get('/api/admin/users').status_code,403)
        self.assertEqual(self.client.get('/api/user/profile').headers['cache-control'],'no-store')

    def test_rollback_conflict_and_expiration(self):
        self.login()
        self.assertEqual(self.client.put('/api/user/profile',json={'username':self.name+'-new','email':self.other_name+'@example.test'}).status_code,409)
        self.assertEqual(self.client.get('/api/auth/me').json()['user']['username'],self.name)
        with get_connection() as db: db.execute("UPDATE sessions SET expires_at='2000-01-01T00:00:00+00:00' WHERE user_id=?",(self.user['id'],))
        self.assertEqual(self.client.get('/api/user/profile').status_code,401)

    def test_admin_user_management_permissions_and_lock(self):
        path=f"/api/admin/users/{self.user['id']}/lock"
        self.assertEqual(self.client.get('/frontend/html/admin_users.html').status_code,200)
        self.assertEqual(self.client.get('/frontend/js/admin_users.js').status_code,200)
        self.assertEqual(self.client.get('/api/admin/users').status_code,401)
        self.assertEqual(self.client.patch(path,params={'locked':True}).status_code,401)
        self.login()
        self.assertEqual(self.client.get('/api/admin/users').status_code,403)
        self.assertEqual(self.client.patch(path,params={'locked':True}).status_code,403)
        victim=fixture.TestClient(fixture.app,base_url='https://testserver')
        self.addCleanup(victim.close)
        victim.post('/api/auth/login',json={'identifier':self.name,'password':'password-123'})
        with get_connection() as db:db.execute("UPDATE users SET role='admin' WHERE id=?",(self.other['id'],))
        self.assertEqual(self.login(self.other_name,'admin').status_code,200)
        response=self.client.get('/api/admin/users')
        self.assertEqual(response.status_code,200)
        self.assertNotIn('password_hash',response.text)
        self.assertNotIn(self.other['id'],[u['id'] for u in response.json()['users']])
        self.assertEqual(self.client.patch(path,params={'locked':True}).status_code,200)
        self.assertEqual(victim.get('/api/auth/me').status_code,401)
        locked_login = victim.post('/api/auth/login',json={'identifier':self.name,'password':'password-123'})
        self.assertEqual(locked_login.status_code,403)
        self.assertEqual(locked_login.json()['detail'],'account_locked')
        self.assertNotIn('set-cookie', locked_login.headers)
        self.assertEqual(victim.post('/api/auth/login',json={'identifier':self.name,'password':'wrong-password'}).status_code,401)
        self.assertTrue(next(u for u in self.client.get('/api/admin/users').json()['users'] if u['id']==self.user['id'])['locked'])
        self.assertEqual(self.client.patch(f"/api/admin/users/{self.other['id']}/lock",params={'locked':True}).status_code,404)
        self.assertEqual(self.client.patch(path,params={'locked':False}).status_code,200)
        self.assertEqual(victim.post('/api/auth/login',json={'identifier':self.name,'password':'password-123'}).status_code,200)
        with get_connection() as db:
            actions=[row[0] for row in db.execute("SELECT action FROM admin_audit_logs WHERE admin_user_id=? AND entity='user' AND entity_id=? ORDER BY id",(self.other['id'],str(self.user['id'])))]
        self.assertEqual(actions,['lock','unlock'])
