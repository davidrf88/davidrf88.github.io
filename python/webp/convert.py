from PIL import Image
import os

def convert_png_to_webp(input_folder, output_folder, quality=85):
    """
    Converts all PNG images in a folder to WEBP format.
    
    Parameters:
    - input_folder: path to folder with .png images
    - output_folder: path to save .webp images
    - quality: WEBP quality (0-100); 80–90 is a good range for web with minimal quality loss
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    for filename in os.listdir(input_folder):
        if filename.lower().endswith(".png"):
            input_path = os.path.join(input_folder, filename)
            output_filename = os.path.splitext(filename)[0] + ".webp"
            output_path = os.path.join(output_folder, output_filename)

            with Image.open(input_path) as img:
                img.save(output_path, "webp", quality=quality, method=6)  # method=6 for better compression

            print(f"Converted: {filename} -> {output_filename}")

# Example usage:
convert_png_to_webp("F:\\DR\\GitHub\\davidrf88\\davidrf88.github.io\\Mi_Cumpleaños\\assets\\img", "F:\\DR\\GitHub\\davidrf88\\davidrf88.github.io\\Mi_Cumpleaños\\assets\\img", quality=85)
