from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math, os

SIZE = 1024

def make_glass_icon(size=SIZE):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = int(size * 0.06)
    r = size - pad * 2

    # Base glass body - deep blue/teal gradient via layered ellipses
    for i in range(60):
        t = i / 59
        alpha = int(180 - t * 80)
        color = (
            int(30 + t * 40),
            int(160 + t * 30),
            int(220 + t * 35),
            alpha
        )
        shrink = int(i * 1.2)
        draw.ellipse(
            [pad + shrink, pad + shrink, pad + r - shrink, pad + r - shrink],
            fill=color
        )

    # Inner darker core for depth
    inner_pad = int(size * 0.22)
    for i in range(30):
        t = i / 29
        alpha = int(60 + t * 40)
        color = (int(10 + t * 20), int(80 + t * 40), int(160 + t * 30), alpha)
        shrink = int(i * 2)
        draw.ellipse(
            [inner_pad + shrink, inner_pad + shrink, size - inner_pad - shrink, size - inner_pad - shrink],
            fill=color
        )

    # Top-left glare (main highlight)
    glare = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glare)
    glare_x1, glare_y1 = int(size * 0.12), int(size * 0.08)
    glare_x2, glare_y2 = int(size * 0.65), int(size * 0.42)
    for i in range(40):
        t = i / 39
        alpha = int(200 - t * 180)
        shrink = int(i * 3.5)
        gd.ellipse(
            [glare_x1 + shrink, glare_y1 + shrink, glare_x2 - shrink, glare_y2 - shrink],
            fill=(255, 255, 255, alpha)
        )
    glare = glare.filter(ImageFilter.GaussianBlur(radius=size * 0.025))
    img = Image.alpha_composite(img, glare)

    # Bottom-right subtle secondary glare
    glare2 = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    g2d = ImageDraw.Draw(glare2)
    for i in range(20):
        t = i / 19
        alpha = int(60 - t * 55)
        shrink = int(i * 4)
        x1, y1 = int(size * 0.55) + shrink, int(size * 0.62) + shrink
        x2, y2 = int(size * 0.88) - shrink, int(size * 0.92) - shrink
        if x1 < x2 and y1 < y2:
            g2d.ellipse([x1, y1, x2, y2], fill=(180, 230, 255, alpha))
    glare2 = glare2.filter(ImageFilter.GaussianBlur(radius=size * 0.03))
    img = Image.alpha_composite(img, glare2)

    # Rim light - thin bright edge at top
    rim = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    for i in range(8):
        alpha = int(120 - i * 15)
        rd.ellipse([pad + i, pad + i, pad + r - i, pad + r - i], outline=(220, 240, 255, alpha), width=1)
    rim = rim.filter(ImageFilter.GaussianBlur(radius=2))
    img = Image.alpha_composite(img, rim)

    # Draw "K" letter
    draw2 = ImageDraw.Draw(img)
    cx, cy = size // 2, size // 2
    stroke = int(size * 0.075)
    arm = int(size * 0.22)
    letter_color = (255, 255, 255, 230)

    # Vertical bar of K
    draw2.rounded_rectangle(
        [cx - int(size * 0.18), cy - arm, cx - int(size * 0.18) + stroke, cy + arm],
        radius=stroke // 2,
        fill=letter_color
    )
    # Upper arm of K
    x_start = cx - int(size * 0.18) + stroke
    draw2.polygon([
        (x_start, cy - int(size * 0.02)),
        (cx + int(size * 0.18), cy - arm),
        (cx + int(size * 0.18) + stroke, cy - arm),
        (cx + int(size * 0.18) + stroke, cy - arm + stroke),
        (x_start + int(size * 0.01), cy + int(size * 0.02)),
    ], fill=letter_color)
    # Lower arm of K
    draw2.polygon([
        (x_start, cy + int(size * 0.02)),
        (cx + int(size * 0.18) + stroke, cy + arm - stroke),
        (cx + int(size * 0.18) + stroke, cy + arm),
        (cx + int(size * 0.18), cy + arm),
        (x_start + int(size * 0.01), cy - int(size * 0.02)),
    ], fill=letter_color)

    # Apply circular mask to keep it round
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse([pad, pad, pad + r, pad + r], fill=255)
    img.putalpha(mask)

    return img

os.makedirs('icons', exist_ok=True)
icon = make_glass_icon()
icon.save('icons/icon_1024.png')

# Generate all sizes needed for icns
sizes = [16, 32, 64, 128, 256, 512, 1024]
for s in sizes:
    resized = icon.resize((s, s), Image.LANCZOS)
    resized.save(f'icons/icon_{s}.png')

print("Icons generated successfully")
