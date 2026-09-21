# Civisto Sale Power Dialer — Twilio-setup

Progressiv dialer: Twilio ringer prospects, AMD filtrerar människor, SMS varnar Johan, sedan brygga till Johans mobil. CRM-kön ligger i Supabase (`get-next-number` / `call-result`).

## Miljövariabler

### Twilio Function / Runtime
| Variabel | Beskrivning |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role-nyckel (hemlig, bara serverside) |
| `JOHAN_MOBILE` | Johans svenska mobil, t.ex. `+4670…` |
| `TWILIO_FROM_SE` | Svenskt Twilio-nummer (caller ID + SMS-avsändare) |

### Supabase Edge Functions
Får automatiskt `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` i runtime.

## Flöde: `/voice/prospect` (AMD-webhook)

1. Utgående samtal skapas mot prospect med `machineDetection: 'Enable'` och `url`/`asyncAmdStatusCallback` → `/voice/prospect?ContactName=…&Company=…&ContactId=…`.
2. Om `AnsweredBy !== human` → häng upp (rapportera disposition via `call-result`).
3. Om `human`:
   - Skicka SMS till `JOHAN_MOBILE` från `TWILIO_FROM_SE`:  
     `Ringer nu: Anna Andersson, Acme AB`
   - TwiML `<Dial callerId="TWILIO_FROM_SE">` till `JOHAN_MOBILE` (brygga).
4. Efter samtal: `POST call-result` med disposition.

SMS-kostnad i Sverige via Twilio: ca **0,05–0,08 SEK** per meddelande.

## Pseudokod: `dialNext`-loop

```
loop:
  next = GET {SUPABASE_URL}/functions/v1/get-next-number
         headers: apikey + Authorization Bearer = SERVICE_ROLE_KEY
  if next.done: break

  call = Twilio.calls.create({
    to: next.phone,
    from: TWILIO_FROM_SE,
    url: /voice/prospect?ContactName=…&Company=…&ContactId=next.contact_id,
    machineDetection: 'Enable',
  })

  wait until call completes (status callback)

  POST {SUPABASE_URL}/functions/v1/call-result
    { contact_id, phone, disposition, duration_seconds, call_sid }
```

## Deploy (Supabase)

```bash
supabase db push
supabase functions deploy get-next-number
supabase functions deploy call-result
```

## Endpoint-sammanfattning

| Method | Path | Syfte |
|---|---|---|
| GET | `/functions/v1/get-next-number` | Låser nästa kontakt → `{contact_id, phone, name, company}` eller `{done:true}` |
| POST | `/functions/v1/call-result` | Sparar disposition + `contactNotes` |

Sales-fältet `status` (cold/warm/hot) rörs **inte** — dialern använder `dial_status`.
