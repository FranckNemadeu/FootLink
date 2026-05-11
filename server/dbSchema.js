const db = require("./db");

const runQuery = (sql, values = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, values, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });

const ensureColumn = async (tableName, columnName, columnDefinition) => {
  const result = await runQuery(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  if (result.length > 0) return;

  await runQuery(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
};

const ensureCoreTables = async () => {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'player',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS players (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      position VARCHAR(100),
      age INT,
      city VARCHAR(100),
      height INT,
      preferred_foot VARCHAR(50),
      team_name VARCHAR(100),
      no_team TINYINT(1) DEFAULT 0,
      bio TEXT,
      profile_photo VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS teams (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      team_name VARCHAR(100),
      city VARCHAR(100),
      level VARCHAR(100),
      category VARCHAR(100),
      player_count INT DEFAULT 0,
      bio TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS matches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id INT NULL,
      type VARCHAR(50),
      match_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS match_stats (
      id INT AUTO_INCREMENT PRIMARY KEY,
      match_id INT,
      player_id INT,
      goals INT DEFAULT 0,
      assists INT DEFAULT 0,
      yellow_cards INT DEFAULT 0,
      red_cards INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS team_invitations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      team_id INT NOT NULL,
      player_id INT NOT NULL,
      requested_by VARCHAR(20) DEFAULT 'team',
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("users", "role", "VARCHAR(20) DEFAULT 'player'");
  await ensureColumn("players", "team_name", "VARCHAR(100)");
  await ensureColumn("players", "no_team", "TINYINT(1) DEFAULT 0");
  await ensureColumn("players", "profile_photo", "VARCHAR(255)");
  await ensureColumn("teams", "player_count", "INT DEFAULT 0");
  await ensureColumn("team_invitations", "requested_by", "VARCHAR(20) DEFAULT 'team'");
};

module.exports = {
  ensureCoreTables,
};
