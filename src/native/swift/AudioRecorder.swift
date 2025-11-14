import Foundation
import ScreenCaptureKit
import AVFoundation

// MARK: - Response Handler
struct Response {
    static func send(_ dict: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let json = String(data: data, encoding: .utf8) else { return }
        print(json)
        fflush(stdout)
    }
}

// MARK: - Main Audio Recorder
class AudioRecorder: NSObject, SCStreamDelegate, SCStreamOutput {
    private var stream: SCStream?
    private var audioFile: AVAudioFile?
    private let semaphore = DispatchSemaphore(value: 0)
    private var streamStarted = false
    private var writeErrorCount = 0
    private let maxWriteErrors = 10

    // Static reference for signal handler
    private static var shared: AudioRecorder?

    // MARK: - Entry Point
    static func main() {
        let recorder = AudioRecorder()
        let args = CommandLine.arguments

        // Parse command: --record <path> OR --check-permissions
        guard args.count >= 2 else {
            Response.send(["code": "INVALID_ARGS", "message": "Usage: --record <path> OR --check-permissions"])
            exit(1)
        }

        switch args[1] {
        case "--check-permissions":
            recorder.checkPermissions()
        case "--record":
            guard args.count >= 3 else {
                Response.send(["code": "INVALID_ARGS", "message": "Missing file path"])
                exit(1)
            }
            recorder.startRecording(path: args[2])
        default:
            Response.send(["code": "INVALID_ARGS", "message": "Unknown command: \(args[1])"])
            exit(1)
        }
    }

    // MARK: - Permission Check
    func checkPermissions() {
        if CGPreflightScreenCaptureAccess() {
            Response.send(["code": "PERMISSION_GRANTED"])
            exit(0)
        } else {
            let granted = CGRequestScreenCaptureAccess()
            Response.send(["code": granted ? "PERMISSION_GRANTED" : "PERMISSION_DENIED"])
            exit(granted ? 0 : 1)
        }
    }

    // MARK: - Recording Lifecycle
    func startRecording(path: String) {
        // Store reference for signal handler
        AudioRecorder.shared = self

        // Setup signal handler for graceful shutdown
        // Must use C function pointer (no context capture)
        signal(SIGINT, handleSignal)

        // Check permissions first
        guard CGPreflightScreenCaptureAccess() else {
            Response.send(["code": "PERMISSION_DENIED"])
            exit(1)
        }

        // Get available display content
        SCShareableContent.getExcludingDesktopWindows(false, onScreenWindowsOnly: false) { [weak self] content, error in
            guard let self = self else { return }

            guard let content = content, error == nil else {
                Response.send(["code": "CONTENT_ERROR", "message": error?.localizedDescription ?? "Unknown"])
                exit(1)
            }

            self.setupStream(content: content, outputPath: path)
        }

        // Wait for recording to finish
        semaphore.wait()
    }

    // MARK: - Signal Handler (C function)
    private static func handleSignal(_ signal: Int32) {
        Response.send(["code": "STOPPING"])
        // Trigger cleanup on main thread
        DispatchQueue.main.async {
            shared?.cleanup()
        }
    }

    // MARK: - Stream Setup
    private func setupStream(content: SCShareableContent, outputPath: String) {
        // Use main display for system audio
        guard let display = content.displays.first else {
            Response.send(["code": "NO_DISPLAY"])
            exit(1)
        }

        // Create audio file
        do {
            audioFile = try createAudioFile(at: outputPath)
        } catch {
            Response.send(["code": "FILE_ERROR", "message": error.localizedDescription])
            exit(1)
        }

        // Configure stream: minimal video, high quality audio
        let config = SCStreamConfiguration()
        config.width = 2  // Minimal video (ScreenCaptureKit requirement)
        config.height = 2
        config.minimumFrameInterval = CMTime(value: 1, timescale: CMTimeScale.max)
        config.showsCursor = false
        config.capturesAudio = true  // THE GOAL
        config.sampleRate = 48000    // 48kHz
        config.channelCount = 2      // Stereo

        // Create filter for display
        let filter = SCContentFilter(display: display, excludingWindows: [])

        // Create and start stream
        stream = SCStream(filter: filter, configuration: config, delegate: self)

        do {
            try stream?.addStreamOutput(self, type: .audio, sampleHandlerQueue: .global())
            stream?.startCapture { error in
                if let error = error {
                    Response.send(["code": "STREAM_ERROR", "message": error.localizedDescription])
                    exit(1)
                } else {
                    self.streamStarted = true
                    Response.send([
                        "code": "RECORDING_STARTED",
                        "path": outputPath,
                        "timestamp": ISO8601DateFormatter().string(from: Date())
                    ])
                }
            }
        } catch {
            Response.send(["code": "STREAM_ERROR", "message": error.localizedDescription])
            exit(1)
        }
    }

    // MARK: - Audio File Creation
    private func createAudioFile(at path: String) throws -> AVAudioFile {
        let url = URL(fileURLWithPath: path)

        // Try FLAC first, fallback to WAV if FLAC fails
        let flacSettings: [String: Any] = [
            AVFormatIDKey: kAudioFormatFLAC,
            AVSampleRateKey: 48000,
            AVNumberOfChannelsKey: 2,
            AVEncoderBitRateKey: 0,
            AVLinearPCMBitDepthKey: 24,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsNonInterleaved: false
        ]

        // Try creating FLAC file
        do {
            return try AVAudioFile(forWriting: url, settings: flacSettings)
        } catch {
            // Fallback to WAV (always works)
            Response.send(["code": "DEBUG", "message": "FLAC failed, using WAV: \(error.localizedDescription)"])

            let wavSettings: [String: Any] = [
                AVFormatIDKey: kAudioFormatLinearPCM,
                AVSampleRateKey: 48000,
                AVNumberOfChannelsKey: 2,
                AVLinearPCMBitDepthKey: 32,
                AVLinearPCMIsFloatKey: true,
                AVLinearPCMIsNonInterleaved: false,
                AVLinearPCMIsBigEndianKey: false
            ]

            return try AVAudioFile(forWriting: url, settings: wavSettings)
        }
    }

    // MARK: - Stream Delegate
    func stream(_ stream: SCStream, didStopWithError error: Error) {
        Response.send(["code": "STREAM_STOPPED", "error": error.localizedDescription])
        cleanup()
    }

    // MARK: - Audio Processing
    func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .audio, streamStarted else { return }
        guard let pcmBuffer = buffer.toPCMBuffer() else {
            writeErrorCount += 1
            if writeErrorCount < 5 {
                Response.send(["code": "BUFFER_CONVERSION_ERROR", "count": writeErrorCount])
            }
            return
        }

        do {
            try audioFile?.write(from: pcmBuffer)
            writeErrorCount = 0  // Reset on successful write
        } catch {
            writeErrorCount += 1
            Response.send(["code": "WRITE_ERROR", "message": error.localizedDescription, "count": writeErrorCount])

            // Stop recording if too many consecutive errors
            if writeErrorCount >= maxWriteErrors {
                Response.send(["code": "TOO_MANY_ERRORS", "message": "Stopping due to \(writeErrorCount) consecutive write errors"])
                cleanup()
            }
        }
    }

    // MARK: - Cleanup
    private func cleanup() {
        stream?.stopCapture { error in
            if let error = error {
                Response.send(["code": "STOP_ERROR", "message": error.localizedDescription])
            }

            self.audioFile = nil
            Response.send([
                "code": "RECORDING_STOPPED",
                "timestamp": ISO8601DateFormatter().string(from: Date())
            ])

            self.semaphore.signal()
            exit(0)
        }
    }
}

// MARK: - CMSampleBuffer Extension
extension CMSampleBuffer {
    func toPCMBuffer() -> AVAudioPCMBuffer? {
        guard let formatDesc = CMSampleBufferGetFormatDescription(self) else { return nil }
        guard let audioStreamDescPtr = CMAudioFormatDescriptionGetStreamBasicDescription(formatDesc) else { return nil }

        // Create mutable copy of the stream description
        var audioStreamDesc = audioStreamDescPtr.pointee

        // Create AVAudioFormat from the stream description
        guard let format = AVAudioFormat(streamDescription: &audioStreamDesc) else { return nil }

        let frameCount = CMSampleBufferGetNumSamples(self)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frameCount)) else { return nil }

        buffer.frameLength = buffer.frameCapacity

        let audioBufferList = buffer.mutableAudioBufferList
        CMSampleBufferCopyPCMDataIntoAudioBufferList(
            self,
            at: 0,
            frameCount: Int32(frameCount),
            into: audioBufferList
        )

        return buffer
    }
}

// MARK: - Run
AudioRecorder.main()
