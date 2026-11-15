// Numbers as the page writes them.

export const count = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

// decimal units, as storage is usually sold: 1 MB = 1,000,000 bytes
export function formatBytes(bytes: number): string {
    const units = ["bytes", "KB", "MB", "GB", "TB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
        value /= 1000;
        unit++;
    }
    return `${unit === 0 || value >= 100 ? Math.round(value) : Number(value.toFixed(1))} ${units[unit]}`;
}
