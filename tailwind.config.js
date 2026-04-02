/** @type {import('tailwindcss').Config} */
module.exports = {
    // Use a wildcard to find ALL ejs files in your project
    content: ["./views/**/*.ejs", "./public/**/*.js"],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                'sage-dark': '#4A675A',
                'sage-med': '#708F81',
                'slate-deep': '#4E657E',
                'stone-bg': '#F2F4F3',
                'charcoal': '#2D312E',
                'dark-bg': '#1c1c1b' // This is the color for dark mode background
            }
        },
    },
    plugins: [],
}