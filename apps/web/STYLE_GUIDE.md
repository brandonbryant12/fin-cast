# Application Style Guide

This guide outlines the basic visual and component styles based on the initial landing page design to ensure consistency across the application, using our semantic Tailwind theme.

## 1. Colors (Semantic Theme - Dark Mode)

Our application uses a dark theme defined with semantic color names in our Tailwind configuration (`tools/tailwind/style.css`). Components should utilize these semantic classes instead of hardcoding colors.

-   **Background:** `bg-background` (Corresponds to `--background`, e.g., Slate 900)
-   **Foreground (Primary Text):** `text-foreground` (Corresponds to `--foreground`, e.g., White)
-   **Foreground (Secondary/Muted Text):** `text-muted-foreground` (Corresponds to `--muted-foreground`, e.g., Slate 400)
-   **Primary Action / Accent:** `bg-primary` / `text-primary` (Corresponds to `--primary`, e.g., Teal 500)
-   **Primary Action Hover:** `hover:bg-primary-hover` (Corresponds to `--primary-hover`, e.g., Teal 600)
-   **Card Background:** `bg-card` (Corresponds to `--card`, e.g., Slate 800)
-   **Card Foreground:** `text-card-foreground` (Corresponds to `--card-foreground`, e.g., White)
-   **Borders:** `border-border` (Corresponds to `--border`, e.g., Slate 700)
-   **Input Background:** `bg-input` (Corresponds to `--input`, e.g., Slate 700)

### Example Usage (Tailwind - Semantic):

-   Main Background: `bg-background`
-   Primary Headings: `text-foreground`
-   Subtitles/Descriptions: `text-muted-foreground`
-   Primary Button Background: `bg-primary`
-   Primary Button Hover: `hover:bg-primary-hover`
-   Card: `bg-card border-border`

## 2. Typography

-   **Headings (h1):**
    -   Font: System default sans-serif
    -   Weight: Bold (`font-bold`)
    -   Size: `text-4xl` (Mobile), `md:text-5xl`, `lg:text-6xl` (Desktop)
    -   Color: `text-foreground`
-   **Sub-Headings/Paragraphs (p):**
    -   Font: System default sans-serif
    -   Weight: Normal (default)
    -   Size: `text-lg` (Mobile), `md:text-xl` (Desktop)
    -   Color: `text-muted-foreground`
-   **Buttons:**
    -   Font: System default sans-serif
    -   Weight: Semibold (`font-semibold`)
    -   Color: `text-primary-foreground` (on primary background), `text-secondary-foreground` (on secondary background), etc.

## 3. Layout

-   **Container:** Use a centered container with horizontal padding. (`container mx-auto px-4`)
-   **Section Padding:** Use vertical padding for sections. (`py-16 md:py-24`)
-   **Responsive Columns:** Use Flexbox or Grid for multi-column layouts that stack on smaller screens (`flex flex-col md:flex-row`, `md:w-1/2`).

## 4. Components

-   **Buttons:**
    -   Use the Shadcn `Button` component (`@repo/ui/components/button`).
    -   **Primary Action Button Style (Example):**
        -   Background: `bg-primary`
        -   Hover Background: `hover:bg-primary-hover`
        -   Text: `text-primary-foreground`, Semibold (`font-semibold`)
        -   Padding: Large (`size="lg"`, `px-8 py-3`)
        -   Rounding: Rounded corners (`rounded-lg`)

## 5. Images

-   Use standard `<img>` tags.
-   Ensure images are responsive (`max-w-full h-auto`).
-   Provide meaningful `alt` text.
-   Consider constraining max-width (`style={{ maxWidth: '...' }}`) for large illustrations if needed.

## 6. Modals / Dialogs

-   Use the Shadcn `Dialog` component (`@repo/ui/components/dialog`).
-   **Style (Dark Theme - Semantic):**
    -   Background: `bg-card`
    -   Border: `border-border`
    -   Text: `text-card-foreground`
    -   Title Text: Centered, 2xl (`text-center text-2xl text-card-foreground`)

---

*This is a living document. Update it as new components and styles are introduced. Prioritize using semantic theme classes.* 