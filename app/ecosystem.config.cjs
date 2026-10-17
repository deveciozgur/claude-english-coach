// PM2 process file: `pm2 start ecosystem.config.cjs` inside the uploaded release folder.
module.exports = {
  apps: [
    {
      name: 'apex-coach',
      script: 'server/index.js',
      cwd: __dirname,
      instances: 1, // one process: file writes go through a single in-process queue
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
