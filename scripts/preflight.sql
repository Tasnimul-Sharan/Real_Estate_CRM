DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" WHERE status <> 'CANCELLED' GROUP BY "plotId" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate active bookings exist; reconcile before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM "Booking" WHERE "bookingAmount" <= 0) OR EXISTS (SELECT 1 FROM "Payment" WHERE amount <= 0) OR EXISTS (SELECT 1 FROM "Plot" WHERE "sizeKatha" <= 0 OR "pricePerKatha" <= 0 OR "totalPrice" <= 0) THEN
    RAISE EXCEPTION 'Non-positive monetary or plot values require review before migrating';
  END IF;
  IF EXISTS (SELECT 1 FROM "Booking" b JOIN "Plot" p ON p.id=b."plotId" WHERE (b.status IN ('PENDING','CONFIRMED') AND p.status <> 'BOOKED') OR (b.status='COMPLETED' AND p.status <> 'SOLD')) THEN
    RAISE EXCEPTION 'Booking and inventory statuses disagree; reconcile before migrating';
  END IF;
END $$;
