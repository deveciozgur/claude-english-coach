// PM2 process file. Run inside the uploaded standalone folder: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'lumos-coach',
      script: 'server.js',
      cwd: __dirname,
      instances: 1, // one process: file writes go through a single in-process queue
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '127.0.0.1', // behind Nginx; use 0.0.0.0 to listen on all interfaces
      },
    },
  ],
};
