# Application Style Guide

This guide outlines the basic visual and component styles based on the initial landing page design to ensure consistency across the application.

## 1. Colors

### Primary Palette (Dark Theme)

-   **Background:** Slate 900 (`#0F172A`) - Used for main page/section backgrounds.
-   **Foreground (Primary Text):** White (`#FFFFFF`) - Used for main headings and body text.
-   **Foreground (Secondary Text):** Gray 300 (`#D1D5DB`) - Used for subtitles, descriptions, and less emphasized text.
-   **Accent:** Teal 500 (`#14B8A6`) - Used for primary buttons and key interactive elements.
-   **Accent Hover:** Teal 600 (`#0D9488`) - Used for hover states on primary accent elements.

### Example Usage (Tailwind):

-   Background: `bg-[#0F172A]`
-   Primary Text: `text-white`
-   Secondary Text: `text-gray-300`
-   Primary Button Background: `bg-[#14B8A6]`
-   Primary Button Hover: `hover:bg-[#0D9488]`

## 2. Typography

-   **Headings (h1):**
    -   Font: System default sans-serif (assumed from Tailwind defaults)
    -   Weight: Bold (`font-bold`)
    -   Size: `text-4xl` (Mobile), `md:text-5xl`, `lg:text-6xl` (Desktop)
    -   Color: White (`text-white`)
-   **Sub-Headings/Paragraphs (p):**
    -   Font: System default sans-serif
    -   Weight: Normal (default)
    -   Size: `text-lg` (Mobile), `md:text-xl` (Desktop)
    -   Color: Gray 300 (`text-gray-300`)
-   **Buttons:**
    -   Font: System default sans-serif
    -   Weight: Semibold (`font-semibold`)
    -   Color: White (`text-white`) on accent background

## 3. Layout

-   **Container:** Use a centered container with horizontal padding. (`container mx-auto px-4`)
-   **Section Padding:** Use vertical padding for sections. (`py-16 md:py-24`)
-   **Responsive Columns:** Use Flexbox or Grid for multi-column layouts that stack on smaller screens (`flex flex-col md:flex-row`, `md:w-1/2`).

## 4. Components

-   **Buttons:**
    -   Use the Shadcn `Button` component (`@repo/ui/components/button`).
    -   **Primary Action Button Style:**
        -   Background: Accent (`bg-[#14B8A6]`)
        -   Hover Background: Accent Hover (`hover:bg-[#0D9488]`)
        -   Text: White (`text-white`), Semibold (`font-semibold`)
        -   Padding: Large (`size="lg"`, `px-8 py-3`)
        -   Rounding: Rounded corners (`rounded-lg`)

## 5. Images

-   Use standard `<img>` tags.
-   Ensure images are responsive (`max-w-full h-auto`).
-   Provide meaningful `alt` text.
-   Consider constraining max-width (`style={{ maxWidth: '...' }}`) for large illustrations if needed.

---

*This is a living document. Update it as new components and styles are introduced.* 