import { AboutDialog, UsageDialog } from "./InformationDialogs";
export default function InformationDialogs({
  kind,
  onClose,
}: {
  kind: "usage" | "about";
  onClose: () => void;
}) {
  return kind === "usage" ? (
    <UsageDialog onClose={onClose} />
  ) : (
    <AboutDialog onClose={onClose} />
  );
}
