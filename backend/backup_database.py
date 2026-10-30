"""Create an online SQLite snapshot without copying an active database file."""
from datetime import datetime, timezone
import sqlite3
from backend.config import DB_PATH


def main():
    if not DB_PATH.is_file():
        raise SystemExit("Database does not exist; nothing to back up.")
    directory = DB_PATH.parent / "backups"
    directory.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    destination = directory / f"glowguide_{stamp}.db"
    source = sqlite3.connect(DB_PATH.as_uri() + "?mode=ro", uri=True)
    target = sqlite3.connect(destination)
    try:
        source.backup(target)
        if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Backup integrity check failed")
    finally:
        target.close()
        source.close()
    print(f"Backup verified: {destination}")


if __name__ == "__main__":
    main()
