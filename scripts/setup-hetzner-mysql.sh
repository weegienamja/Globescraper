#!/bin/bash
# Setup MySQL for GlobeScraper on Hetzner VPS

mysql <<'EOF'
CREATE DATABASE IF NOT EXISTS globescraper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'globescraper'@'%' IDENTIFIED BY 'GS_h3tzn3r_2026!';
GRANT ALL PRIVILEGES ON globescraper.* TO 'globescraper'@'%';
FLUSH PRIVILEGES;
SELECT User, Host FROM mysql.user WHERE User='globescraper';
SHOW DATABASES LIKE 'globescraper';
EOF

# Allow remote connections: bind to all interfaces
sed -i 's/^bind-address\s*=.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sed -i 's/^mysqlx-bind-address\s*=.*/mysqlx-bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf

# Restart MySQL to apply
systemctl restart mysql

echo "MySQL setup complete. Testing remote access..."
mysql -u globescraper -p'GS_h3tzn3r_2026!' -e "SELECT 'Remote access OK' AS status;" globescraper
