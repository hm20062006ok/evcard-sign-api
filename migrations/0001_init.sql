-- Migration number: 0001 	 2025-08-27T07:18:47.121Z
DROP TABLE IF EXISTS tokens;
CREATE TABLE tokens (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        account_name TEXT NOT NULL,
                        token TEXT NOT NULL UNIQUE,
                        next_execution_time DATETIME NOT NULL,
                        last_execution_time DATETIME,
                        last_result TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);