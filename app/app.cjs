// CommonJS entry for hosts whose Node.js panel (cPanel "Setup Node.js App" / Passenger) expects a
// require()-able startup file. It just loads the ES module server. With PM2 or SSH, use server/index.js.
import('./server/index.js');
