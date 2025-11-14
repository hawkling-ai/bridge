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

    let stdoutBuffer = '';
    let stderrBuffer = '';

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

    let resolved = false;

    // Parse JSON responses from Swift
    proc.stdout.on('data', data => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || ''; // Keep incomplete line

      lines.filter(Boolean).forEach(line => {
        console.log('[Swift stdout]:', line); // Debug log

        try {
          const response = JSON.parse(line);

          switch (response.code) {
            case 'RECORDING_STARTED':
              emitter.events.start?.(response);
              resolved = true;
              resolve(emitter);
              break;

            case 'STOPPING':
              emitter.events.stopping?.();
              break;

            case 'RECORDING_STOPPED':
              emitter.events.stop?.(response);
              break;

            // Fatal errors - reject if not yet resolved
            case 'PERMISSION_DENIED':
            case 'CONTENT_ERROR':
            case 'NO_DISPLAY':
            case 'FILE_ERROR':
            case 'STREAM_ERROR':
            case 'TOO_MANY_ERRORS':
              const fatalError = new Error(response.message || response.code);
              emitter.events.error?.(fatalError);
              if (!resolved) {
                resolved = true;
                reject(fatalError);
              }
              break;

            // Non-fatal errors - just emit event
            case 'WRITE_ERROR':
            case 'BUFFER_CONVERSION_ERROR':
            case 'STOP_ERROR':
            case 'STREAM_STOPPED':
              emitter.events.error?.(new Error(response.message || response.code));
              break;

            // Debug/info messages
            case 'DEBUG':
              console.log('[Swift debug]:', response.message);
              emitter.events.debug?.(response.message);
              break;

            default:
              emitter.events.message?.(response);
          }
        } catch (e) {
          // Non-JSON output, log as debug
          console.log('[Swift debug]:', line);
          emitter.events.debug?.(line);
        }
      });
    });

    proc.stderr.on('data', data => {
      stderrBuffer += data.toString();
      console.error('[Swift stderr]:', data.toString());
      emitter.events.error?.(new Error(data.toString()));
    });

    proc.on('error', (err) => {
      console.error('[Spawn error]:', err);
      reject(err);
    });

    proc.on('close', code => {
      if (code !== 0 && code !== null && !resolved) {
        const errorMsg = `Swift recorder exited with code ${code}. ` +
          `stdout: "${stdoutBuffer}", stderr: "${stderrBuffer}"`;
        console.error(errorMsg);
        resolved = true;
        reject(new Error(errorMsg));
      }
    });
  });

module.exports = {
  checkPermissions,
  startRecording,
  getBinaryPath,
};
