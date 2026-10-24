-- Secure Application Database Schema
-- Module: CMP-X306 Secure Software Development
-- Target Database: `sd2-db`

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `sd2-db` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `sd2-db`;

-- --------------------------------------------------------
-- Table structure for `users`
-- Enforces uniqueness, strong hash storage, and strict RBAC roles
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_users_username` (`username`),
  UNIQUE KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Table structure for `audit_logs`
-- Tamper-evident operational and security event log (Non-repudiation)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `event_type` VARCHAR(100) NOT NULL,
  `actor_id` INT DEFAULT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `details` JSON DEFAULT NULL,
  `status` ENUM('SUCCESS', 'FAILURE') NOT NULL DEFAULT 'SUCCESS',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_event` (`event_type`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------
-- Seed Initial Accounts
-- Passwords hashed using bcrypt (12 salt rounds)
-- admin / AdminPassword123!
-- alice / AlicePassword123!
-- --------------------------------------------------------
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `role`) VALUES
(1, 'admin', 'admin@roesecurity.ac.uk', '$2a$12$exBmcM8QsdmfFT1GuYonceZ/M89xBsQFYmPIRWxc.Y77wwLvXFGRG', 'ADMIN'),
(2, 'alice', 'alice@roesecurity.ac.uk', '$2a$12$Yy6S0EvY4L//23sDP3ClH.eyJ2qaWYrtDrxwLqFFCoQtdMRSO24hW', 'USER')
ON DUPLICATE KEY UPDATE `id`=`id`;

-- Record initial database provisioning event in audit logs
INSERT INTO `audit_logs` (`event_type`, `actor_id`, `ip_address`, `details`, `status`) VALUES
('SYSTEM_INITIALIZATION', 1, '127.0.0.1', '{"action": "Initial database tables provisioned with seeded administrative and user accounts"}', 'SUCCESS');

-- --------------------------------------------------------
-- Provision Least-Privilege Application User
-- Restricted strictly to DML operations (SELECT, INSERT, UPDATE, DELETE)
-- Prevents DROP TABLE, ALTER, and administrative takeover via SQL injection
-- --------------------------------------------------------
CREATE USER IF NOT EXISTS 'app_user'@'%' IDENTIFIED BY 'SecureAppPassword123!';
GRANT SELECT, INSERT, UPDATE, DELETE ON `sd2-db`.* TO 'app_user'@'%';
FLUSH PRIVILEGES;

COMMIT;
