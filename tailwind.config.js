/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        xuanqing: "#0f1c2e",
        zhusha: "#a8322d",
        andai: "#2c2c2c",
        xuanzhi: "#f5ecd9",
        moink: "#1a1a1a",
        jinhuang: "#c9a96e",
        qingdai: "#3d5a6c",
      },
      fontFamily: {
        song: ["\"Noto Serif SC\"", "\"Source Han Serif SC\"", "SimSun", "serif"],
        kai: ["\"KaiTi\"", "\"STKaiti\"", "serif"],
      },
      backgroundImage: {
        "rice-paper":
          "radial-gradient(ellipse at top, rgba(201,169,110,0.08), transparent 60%), radial-gradient(ellipse at bottom, rgba(168,50,45,0.05), transparent 60%)",
      },
    },
  },
  plugins: [],
};
