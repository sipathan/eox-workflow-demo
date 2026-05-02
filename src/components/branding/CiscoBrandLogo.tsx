type Props = {
  className?: string;
};

/**
 * Cisco wordmark from Wikimedia Commons (vector), served from `public/branding/cisco-logo.svg`.
 * @see https://commons.wikimedia.org/wiki/File:Cisco_logo.svg — comply with the file page license and Cisco trademark guidelines for your use case.
 * Uses `block` + `shrink-0` so flex parents do not collapse the image width.
 */
export function CiscoBrandLogo({ className }: Props) {
  return (
    <img
      src="/branding/cisco-logo.svg"
      alt="Cisco"
      width={72}
      height={38}
      decoding="async"
      className={["block max-w-full shrink-0 object-contain object-left", className].filter(Boolean).join(" ")}
    />
  );
}
