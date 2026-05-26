module.exports = {
  apps: [{
    name: "claudiaclaw",
    script: "npx",
    args: "claudiaclaw start",
    cwd: "./",
    interpreter: "none",

    // Auto-restart
    autorestart: true,
    restart_delay: 3000,
    max_restarts: 10,

    // Logging
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    error_file: "./logs/claudiaclaw-error.log",
    out_file: "./logs/claudiaclaw-out.log",
    merge_logs: true,

    // Environment
    env: {
      NODE_ENV: "production",
    },

    // Watch for changes (optional)
    watch: false,

    // Memory management
    max_memory_restart: "500M",

    // Graceful shutdown
    kill_timeout: 10000,
    listen_timeout: 3000,
  }]
}
