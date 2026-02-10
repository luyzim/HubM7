/*
  Warnings:

  - You are about to drop the column `commandTexte` on the `commands_mkt` table. All the data in the column will be lost.
  - You are about to drop the column `nome` on the `commands_mkt` table. All the data in the column will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[name]` on the table `commands_mkt` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `admins` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commandText` to the `commands_mkt` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "commands_mkt_nome_key";

-- AlterTable
ALTER TABLE "admins" ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "commands_mkt" DROP COLUMN "commandTexte",
DROP COLUMN "nome",
ADD COLUMN     "commandText" TEXT NOT NULL,
ADD COLUMN     "name" TEXT;

-- DropTable
DROP TABLE "users";

-- CreateTable
CREATE TABLE "n2" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "pass_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n1" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "pass_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n1_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interfaces_mkt" (
    "id" SERIAL NOT NULL,
    "interfaceName" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "comentario" TEXT,
    "macAddress" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scanId" INTEGER,

    CONSTRAINT "interfaces_mkt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interfaces_ip_address" (
    "id" SERIAL NOT NULL,
    "interfaceId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "comment" TEXT,

    CONSTRAINT "interfaces_ip_address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vcn_mkt" (
    "id" SERIAL NOT NULL,
    "vcn" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "gatewayStatus" TEXT,
    "distance" TEXT NOT NULL,
    "comentario" TEXT,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "scanId" INTEGER,
    "dstAddress" TEXT NOT NULL,
    "mkt_scanId" INTEGER,

    CONSTRAINT "vcn_mkt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mkt_scan" (
    "id" SERIAL NOT NULL,
    "parceiro_gary" TEXT NOT NULL,
    "parceiro_plakton" TEXT NOT NULL,
    "routerIp" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mkt_scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WikiTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "editor" TEXT NOT NULL DEFAULT 'markdown',
    "locale" TEXT NOT NULL DEFAULT 'pt-br',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WikiTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "n2_email_key" ON "n2"("email");

-- CreateIndex
CREATE UNIQUE INDEX "n1_email_key" ON "n1"("email");

-- CreateIndex
CREATE UNIQUE INDEX "interfaces_mkt_ip_interfaceName_key" ON "interfaces_mkt"("ip", "interfaceName");

-- CreateIndex
CREATE INDEX "interfaces_ip_address_address_idx" ON "interfaces_ip_address"("address");

-- CreateIndex
CREATE UNIQUE INDEX "interfaces_ip_address_interfaceId_address_key" ON "interfaces_ip_address"("interfaceId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "vcn_mkt_ip_vcn_dstAddress_gateway_distance_key" ON "vcn_mkt"("ip", "vcn", "dstAddress", "gateway", "distance");

-- CreateIndex
CREATE UNIQUE INDEX "WikiTemplate_name_key" ON "WikiTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "commands_mkt_name_key" ON "commands_mkt"("name");

-- AddForeignKey
ALTER TABLE "interfaces_mkt" ADD CONSTRAINT "interfaces_mkt_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "mkt_scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interfaces_ip_address" ADD CONSTRAINT "interfaces_ip_address_interfaceId_fkey" FOREIGN KEY ("interfaceId") REFERENCES "interfaces_mkt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vcn_mkt" ADD CONSTRAINT "vcn_mkt_mkt_scanId_fkey" FOREIGN KEY ("mkt_scanId") REFERENCES "mkt_scan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
