export function analyzeSequence(input: string, nucleotide = false) {
  const sequence = input
    .replace(/^>.*$/gm, "")
    .replace(/\s/g, "")
    .toUpperCase();
  if (
    !sequence ||
    !new RegExp(nucleotide ? "^[ACGTUN]+$" : "^[ACDEFGHIKLMNPQRSTVWY]+$").test(
      sequence,
    )
  )
    throw Error(
      "Invalid sequence alphabet. Use standard amino acids or A/C/G/T/U/N.",
    );
  const composition: Record<string, number> = {};
  for (const letter of sequence)
    composition[letter] = (composition[letter] || 0) + 1;
  return {
    sequence,
    length: sequence.length,
    composition,
    note: "Sequence properties are not evidence of efficacy.",
  };
}
