CREATE UNIQUE INDEX "Booking_one_active_per_plot" ON "Booking" ("plotId")
WHERE "status" IN ('PENDING', 'CONFIRMED', 'COMPLETED');
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_amount_positive" CHECK ("bookingAmount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_size_positive" CHECK ("sizeKatha" > 0);
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_price_positive" CHECK ("pricePerKatha" > 0 AND "totalPrice" > 0);
