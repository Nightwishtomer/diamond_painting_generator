# 💎 JS Diamond Mosaic Generator

A lightweight and interactive **JavaScript-based mosaic generator**. Transform any image into a diamond-style mosaic with custom settings, color reduction, and export options.

---

## 🔹 Features

- Upload any image (`JPEG`, `PNG`) and generate a mosaic.
- Adjustable **grid size / detail level**.
- Limit the number of **colors in the palette**.
- **Depth rounding** for color quantization.
- **Cell size** for scaling mosaic cells.
- Switch between **Color Mode** 🎨 and **Print Mode** 🖨.
- Export as **PNG** or **JSON**.
- Automatic palette generation with symbols for each color.
- Simple **dithering** algorithm for smoother transitions.
- Clean **UI with sidebar controls**.

---

## ⚙️ How to Use

1. Open `index.html` in your browser.
2. Upload an image using the **file input**.
3. Adjust settings:
   - **Detail Level**: grid resolution.
   - **Max Colors**: max colors in the palette.
   - **Depth Rounding**: color quantization step.
   - **Cell Size**: size of each mosaic cell.
4. Click **Generate** 🚀.
5. Switch between **Color** 🎨 and **Print** 🖨 modes.
6. Export the result as **PNG** or **JSON**.

---

## 🖌 Folder Structure

```
.
├── index.html       # Main HTML
├── app.js           # Core JS logic
├── styles/
│   ├── base.css
│   ├── layout.css
│   └── components.css
└── README.md        # This file
```

---

## 🔧 Technologies

- **Vanilla JavaScript** – ES6 classes, modules.
- **Canvas API** – for rendering mosaics.
- **HTML & CSS** – simple responsive UI.
- **K-Means Clustering** – color reduction.
- **Error Diffusion Dithering** – smoother image conversion.

---

## 💡 Notes

- This project is fully client-side; no backend needed.
- JSON export includes `grid` and `palette`, which can be reloaded or used elsewhere.
- Symbols inside cells provide contrast for visual guidance, especially in print mode.

---

## 📜 License

MIT License – free to use, modify, and distribute.

---

## 👨‍💻 Author

Artiem Diakonov
