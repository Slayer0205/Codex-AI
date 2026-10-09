export const money = (tiyin: number) =>
  new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 2 }).format(
    tiyin / 100,
  );
