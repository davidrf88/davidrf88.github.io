from PIL import Image

def clean_hard_edges(input_path, output_path, black_threshold=50):
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()

    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]

            # Determinar luminancia aproximada
            luminance = 0.299 * r + 0.587 * g + 0.114 * b

            if luminance < black_threshold:
                pixels[x, y] = (0, 0, 0, 255)  # Negro puro y opaco
            else:
                pixels[x, y] = (255, 255, 255, 255)  # Blanco puro y opaco

    img.save(output_path, "PNG")
    print(f"Imagen limpiada con bordes duros guardada en: {output_path}")

# Uso
clean_hard_edges("C:\\Users\\david\\OneDrive\\Documentos\\mytest\\drawing.png", "C:\\Users\\david\\OneDrive\\Documentos\\mytest\\drawing_clean.png")
