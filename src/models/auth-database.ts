import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

export type UserRole = 'admin' | 'user';

export interface User {
  id: number;
  username: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
}

export interface ServerSettings {
  httpPort: number;
  tcpPort: number;
  updatedAt: string;
}

export class AuthDatabase {
  private static instance: AuthDatabase;
  private db: Database.Database;

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'auth.db');
    this.db = new Database(dbPath);

    this.initialize();
  }

  static getInstance(): AuthDatabase {
    if (!this.instance) {
      this.instance = new AuthDatabase();
    }
    return this.instance;
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS server_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        httpPort INTEGER NOT NULL,
        tcpPort INTEGER NOT NULL,
        updatedAt TEXT NOT NULL
      );
    `);

    // Seed default server settings if missing
    const countSettings = this.db
      .prepare('SELECT COUNT(*) as count FROM server_settings')
      .get() as { count: number };
    if (countSettings.count === 0) {
      const now = new Date().toISOString();
      this.db
        .prepare(
          'INSERT INTO server_settings (id, httpPort, tcpPort, updatedAt) VALUES (1, ?, ?, ?)'
        )
        .run(3000, 5086, now);
    }

    // Seed default admin user if none exists
    const countUsers = this.db
      .prepare('SELECT COUNT(*) as count FROM users')
      .get() as { count: number };
    if (countUsers.count === 0) {
      const now = new Date().toISOString();
      const defaultPassword = 'admin1234';
      const passwordHash = bcrypt.hashSync(defaultPassword, 10);
      this.db
        .prepare(
          'INSERT INTO users (username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?)'
        )
        .run('admin', passwordHash, 'admin', now);
      // eslint-disable-next-line no-console
      console.log(
        '⚠️ Usuário admin padrão criado: username="admin", senha="admin1234". Altere assim que possível.'
      );
    }
  }

  getServerSettings(): ServerSettings {
    const row = this.db
      .prepare('SELECT httpPort, tcpPort, updatedAt FROM server_settings WHERE id = 1')
      .get();
    return row as ServerSettings;
  }

  updateServerSettings(httpPort: number, tcpPort: number): ServerSettings {
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE server_settings SET httpPort = ?, tcpPort = ?, updatedAt = ? WHERE id = 1')
      .run(httpPort, tcpPort, now);
    return { httpPort, tcpPort, updatedAt: now };
  }

  findUserByUsername(username: string): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    return row as User | undefined;
  }

  findUserById(id: number): User | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row as User | undefined;
  }

  listUsers(): Omit<User, 'passwordHash'>[] {
    const rows = this.db
      .prepare('SELECT id, username, role, createdAt FROM users ORDER BY id ASC')
      .all();
    return rows as Omit<User, 'passwordHash'>[];
  }

  createUser(
    username: string,
    password: string,
    role: UserRole
  ): Omit<User, 'passwordHash'> {
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = this.db
      .prepare(
        'INSERT INTO users (username, passwordHash, role, createdAt) VALUES (?, ?, ?, ?)'
      )
      .run(username, passwordHash, role, now);
    return {
      id: Number(result.lastInsertRowid),
      username,
      role,
      createdAt: now,
    };
  }

  updateUser(
    id: number,
    fields: { password?: string; role?: UserRole }
  ): Omit<User, 'passwordHash'> | undefined {
    const existing = this.findUserById(id);
    if (!existing) return undefined;

    const role = fields.role ?? existing.role;
    let passwordHash = existing.passwordHash;
    if (fields.password) {
      passwordHash = bcrypt.hashSync(fields.password, 10);
    }

    this.db
      .prepare('UPDATE users SET passwordHash = ?, role = ? WHERE id = ?')
      .run(passwordHash, role, id);

    return {
      id: existing.id,
      username: existing.username,
      role,
      createdAt: existing.createdAt,
    };
  }

  deleteUser(id: number): boolean {
    // Prevent deleting the last admin
    const adminCountRow = this.db
      .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
      .get() as { count: number };
    const userRow = this.findUserById(id);
    if (userRow?.role === 'admin' && adminCountRow.count <= 1) {
      return false;
    }

    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }
}


