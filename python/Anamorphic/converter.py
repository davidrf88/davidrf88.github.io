import cv2
import tkinter as tk
from tkinter import filedialog
import subprocess
from datetime import datetime

def resize_video(input_path, output_path, scale_factor=0.83):
    cap = cv2.VideoCapture(input_path)

    if not cap.isOpened():
        print("Error: Could not open video.")
        return
    
    # Get original dimensions
    fps = cap.get(cv2.CAP_PROP_FPS)
    original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # New dimensions (width remains, height scales to 83%)
    new_width = original_width
    new_height = int(original_height * scale_factor)

    # Set up FFmpeg command for encoding with HEVC
    ffmpeg_command = [ 
    "ffmpeg", "-i", input_path,
    "-y",  # Overwrite output file if it exists
    "-pix_fmt", "bgr24",  # Pixel format (OpenCV uses bgr24)
    "-s", f"{new_width}x{new_height}",  # Resize output dimensions
    "-r", str(fps),  # Use the same frame rate as the input video
    "-i", "-",  # Input comes from stdin
    "-c:v", "libx265",  # Use HEVC (H.265) codec
    "-crf", "28",  # CRF value for quality (lower means better quality, larger file)
    "-preset", "slow",  # Slower preset for better compression
    output_path  # Output file path
    ]

    # Start the FFmpeg process
    process = subprocess.Popen(ffmpeg_command, stdin=subprocess.PIPE)

    # Read and process frames from the input video
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Resize the frame
        resized_frame = cv2.resize(frame, (new_width, new_height), interpolation=cv2.INTER_LANCZOS4)

        # Write the resized frame to FFmpeg's stdin
        process.stdin.write(resized_frame.tobytes())

    # Release resources
    cap.release()
    process.stdin.close()
    process.wait()
    

# Open file dialog to select a video
def select_video():
    root = tk.Tk()
    root.withdraw()
    file_path = filedialog.askopenfilename(filetypes=[("Video files", "*.mp4;*.avi;*.mov")])

    if file_path:
        current_time = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        output_path = f"F:\\DR\\TEST_VIDEO{current_time}.mp4"
        resize_video(file_path, output_path, scale_factor=0.83)
#if __name__ == "__main__":
select_video()
