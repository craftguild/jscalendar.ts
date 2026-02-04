/**
 * Select candidate positions based on BYSETPOS rules.
 * @param candidates Candidate date-time strings.
 * @param setPos BYSETPOS indices (1-based, negative from end).
 * @return Selected date-time strings in the order of set positions.
 */
export function applyBySetPos(
    candidates: string[],
    setPos: number[],
): string[] {
    const sorted = [...candidates].sort();
    const result: string[] = [];
    const total = sorted.length;
    for (const pos of setPos) {
        const index = pos > 0 ? pos - 1 : total + pos;
        if (index >= 0 && index < total) {
            const value = sorted[index];
            if (value !== undefined) {
                result.push(value);
            }
        }
    }
    return result;
}
