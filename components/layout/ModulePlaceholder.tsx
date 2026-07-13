export default function ModulePlaceholder({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 8 }}>
                {title}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 520, lineHeight: 1.6 }}>
                {description}
            </p>
        </div>
    );
}
