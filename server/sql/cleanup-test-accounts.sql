START TRANSACTION;

CREATE TEMPORARY TABLE cleanup_users (
  id INT PRIMARY KEY
);

INSERT INTO cleanup_users (id)
SELECT id
FROM users
WHERE email LIKE 'test.%@footlink.local'
   OR email LIKE 'delete.%@footlink.local'
   OR email LIKE 'diag.%@footlink.local'
   OR name IN ('Diag Test', 'Test Render', 'Test Public', 'Test Local', 'Delete Player', 'Delete Team');

DELETE ms
FROM match_stats ms
JOIN players p ON p.id = ms.player_id
JOIN cleanup_users cu ON cu.id = p.user_id;

DELETE ms
FROM match_stats ms
JOIN matches m ON m.id = ms.match_id
JOIN teams t ON t.id = m.team_id
JOIN cleanup_users cu ON cu.id = t.user_id;

DELETE ti
FROM team_invitations ti
JOIN players p ON p.id = ti.player_id
JOIN cleanup_users cu ON cu.id = p.user_id;

DELETE ti
FROM team_invitations ti
JOIN teams t ON t.id = ti.team_id
JOIN cleanup_users cu ON cu.id = t.user_id;

DELETE m
FROM matches m
JOIN teams t ON t.id = m.team_id
JOIN cleanup_users cu ON cu.id = t.user_id;

UPDATE players p
JOIN teams t ON LOWER(p.team_name) = LOWER(t.team_name)
JOIN cleanup_users cu ON cu.id = t.user_id
SET p.team_name = NULL,
    p.no_team = 1;

DELETE p
FROM players p
JOIN cleanup_users cu ON cu.id = p.user_id;

DELETE t
FROM teams t
JOIN cleanup_users cu ON cu.id = t.user_id;

DELETE u
FROM users u
JOIN cleanup_users cu ON cu.id = u.id;

DROP TEMPORARY TABLE cleanup_users;

COMMIT;
