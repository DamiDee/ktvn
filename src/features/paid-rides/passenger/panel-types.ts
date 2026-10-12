/** Props every sheet-hosting panel receives from the passenger screen. */
export interface SheetHostProps {
  onCoverChange: (cover: { bottom: number; left: number }) => void;
  bottomOffset: number;
}
