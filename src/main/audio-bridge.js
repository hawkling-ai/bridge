const { spawn } = require('child_process');
const path = require('path');

// Path to Swift binary (compiled at build time)
const getBinaryPath = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  return isDev
    ? path.join(__dirname, '../native/swift/AudioRecorder')
    : path.join(process.resourcesPath, 'AudioRecorder');
};

// Check if Screen Recording permission is granted
const checkPermissions = () =>
  new Promise((resolve, reject) => {
    const proc = spawn(getBinaryPath(), ['--check-permissions']);
    let output = '';

    proc.stdout.on('data', data => output += data.toString());
    proc.on('close', code => {
      if (code === 0) {
        const response = JSON.parse(output);
        resolve(response.code === 'PERMISSION_GRANTED');
      } else {
        resolve(false);
      }
    });
    proc.on('error', reject);
  });

// Start recording system audio to file
const startRecording = (outputPath) =>
  new Promise((resolve, reject) => {
    const proc = spawn(getBinaryPath(), ['--record', outputPath]);

    // Event emitter pattern for progress updates
    const emitter = {
      process: proc,
      events: {},
      on(event, handler) {
        this.events[event] = handler;
        return this;
      },
      stop() {
        proc.kill('SIGINT'); // Graceful shutdown
      }
    };

    // Parse JSON responses from Swift
    proc.stdout.on('data', data => {
      const lines = data.toString().split('\n').filter(Boolean);

      lines.forEach(line => {
        try {
          const response = JSON.parse(line);

          switch (response.code) {
            case 'RECORDING_STARTED':
              emitter.events.start?.(response);
              resolve(emitter);
              break;

            case 'STOPPING':
              emitter.events.stopping?.();
              break;

            case 'RECORDING_STOPPED':
              emitter.events.stop?.(response);
              break;

            case 'WRITE_ERROR':
            case 'STREAM_ERROR':
            case 'STREAM_STOPPED':
              emitter.events.error?.(new Error(response.message || response.code));
              break;

            default:
              emitter.events.message?.(response);
          }
        } catch (e) {
          // Non-JSON output, log as debug
          emitter.events.debug?.(line);
        }
      });
    });

    proc.stderr.on('data', data => {
      emitter.events.error?.(new Error(data.toString()));
    });

    proc.on('error', reject);

    proc.on('close', code => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Recorder exited with code ${code}`));
      }
    });
  });

module.exports = {
  checkPermissions,
  startRecording,
  getBinaryPath,
};
