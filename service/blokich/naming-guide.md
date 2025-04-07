# 📚 Blokich Naming Convention Guide

Ovaj dokument definira dogovorene konvencije imenovanja kroz cijeli Blokich projekt, uključujući backend (NestJS + MongoDB) i frontend (Angular).

---

## 📦 MongoDB

### 🏁 Baza

- **Naziv**: `blokich`
- **Format**: lowercase, bez razmaka

### 📁 Kolekcije

- **Jednina** (ne množina!)
- **Format**: lowercase
- **Primjeri**:
  - `sluzba`
  - `vozac`
  - `disponent`

> ℹ Ako koristiš `MongooseModule.forFeature`, koristi `collection: 'sluzba'` da izbjegneš automatsku pluralizaciju.

---

## ⚙️ Mongoose Modeli

### 🧱 Klasa modela

- **Format**: PascalCase (jednina)
- **Primjeri**:
  - `Sluzba`
  - `Vozac`
  - `Disponent`

### 📄 Datoteke

- **Format**: lowercase + `.schema.ts`
- **Primjeri**:
  - `sluzba.schema.ts`
  - `vozac.schema.ts`

---

## 🌐 REST API (NestJS Controlleri)

### 📂 Moduli

- `modules/sluzba.module.ts`

### 📄 Controller

- `controllers/sluzba.controller.ts`

### 📄 Servisi

- `services/sluzba.service.ts`

### 📊 Endpointi

- `GET /sluzba`
- `GET /sluzba/:br_sl`
- `GET /vozac/:id`
- `GET /disponent/:radnik`

> ✅ Svi endpointi su u **lowercase**, koriste **jedninu** i opisno su vezani uz resurs.

---

## 🎨 Angular (Frontend)

### 📄 Komponente

- `sluzba.component.ts`
- `vozac.component.ts`

### 📄 Servisi

- `sluzba.service.ts`

### 🌐 Rute

- `/sluzba`
- `/vozac`
- `/disponent`

---

## ✅ Preporuke

- ✅ Uvijek koristi **jedninu** za modele i kolekcije
- ✅ Drži sve u lowercase osim klasa
- ✅ Uvijek specificiraj `collection: 'ime'` u Mongoose modelima
- ✅ Ne koristi camelCase za URL putanje

---

> 📌 Verzija: 1.0  
> 📅 Ažurirano: 2025-03-26
