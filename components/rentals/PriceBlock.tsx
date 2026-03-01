/** Format a monthly USD price as "$800 pcm" */
export function PriceBlock({
  priceMonthlyUsd,
}: {
  priceMonthlyUsd: number | null;
}) {
  if (!priceMonthlyUsd) {
    return (
      <div className="rental-card__price-block">
        <span className="rental-card__price">Price on request</span>
      </div>
    );
  }

  const monthly = Math.round(priceMonthlyUsd);
  const weekly = Math.round((priceMonthlyUsd * 12) / 52);

  return (
    <div className="rental-card__price-block">
      <span className="rental-card__price">${monthly.toLocaleString()} pcm</span>
      <span className="rental-card__price-weekly">${weekly.toLocaleString()} pw</span>
    </div>
  );
}
