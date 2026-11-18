-- CreateEnum
CREATE TYPE "RestaurantRole" AS ENUM ('OWNER', 'MANAGER', 'KITCHEN');

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_restaurant_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" "RestaurantRole" NOT NULL DEFAULT 'MANAGER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_restaurant_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_restaurant_roles_userId_restaurantId_key" ON "user_restaurant_roles"("userId", "restaurantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_restaurant_roles_userId_idx" ON "user_restaurant_roles"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_restaurant_roles_restaurantId_idx" ON "user_restaurant_roles"("restaurantId");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_restaurant_roles_userId_fkey'
    ) THEN
        ALTER TABLE "user_restaurant_roles" ADD CONSTRAINT "user_restaurant_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_restaurant_roles_restaurantId_fkey'
    ) THEN
        ALTER TABLE "user_restaurant_roles" ADD CONSTRAINT "user_restaurant_roles_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

