-- CreateIndex
CREATE UNIQUE INDEX "hod_appointments_one_current_per_post" ON "hod_appointments"("post_id") WHERE (to_date IS NULL);

