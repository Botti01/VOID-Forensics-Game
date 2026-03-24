# V.O.I.D. (Volatile Output Investigation & Discovery)

<p align="center">
  <em>Un "Serious Game" per la didattica della Computer Forensics, incentrato sull'analisi della memoria RAM (Memory Forensics).</em>
</p>

## 🔎 Concept del Gioco: Live Target
V.O.I.D. è un simulatore di **Live Incident Response** basato puramente su Command-Line Interface (CLI) web, focalizzato al 100% sull'interazione iperrealistica dal terminale senza distrazioni grafiche 3D.
Mette il giocatore nei panni di un SOC Analyst alle prese con un attacco ransomware *attualmente in corso* su un server aziendale.

La macchina non può essere spenta o le chiavi in memoria andranno perse (Order of Volatility). Il giocatore accede tramite un terminale remoto (o una console locale simulata) con tool di analisi della memoria.
Il fattore differenziante è **la corsa contro il tempo**: messaggi di sistema allerteranno periodicamente il giocatore sull'avanzamento distruttivo del malware, forzando un'analisi forense metodica ma fulminea.

**Obiettivo:** Isolare la catena di infezione, scovare il processo iniettato (es. tramite *Process Hollowing*), trovare in memoria la chiave d'innesco AES ed estirpare il processo nocivo (`kill`) bloccando l'emorragia di dati.

## 🎯 Obiettivi Didattici (Learning Outcomes)
Progetto per "Computer Forensics and Cyber Crime Analysis" (Prof. Atzeni):
- **Live Response sotto Stress:** Simulare l'indagine a caldo durante un incidente ad alto impatto. Non c'è tempo per imaging tradizionale (dump totale), l'operatore deve applicare memory triage live.
- **Order of Volatility Pratico:** Capire la crucialità di mantenere l'host acceso e il grave rischio di perdita chiavi.
- **Identificazione Catene Malware:** Comprendere le correlazioni tra connessioni anomale e Parent/Child PID per risalire al dropper o loader originale.
- **Analisi Memoria Interattiva:** Applicare tool stile Volatility o Sysinternals (`pstree`, `malfind`, `yarascan`) su output che mutano rispetto ai classici dump statici.

## ⚙️ Meccaniche di Gioco Estreme
A differenza delle normali analisi forensi statiche post-mortem, V.O.I.D. utilizza uno **stato dinamico JSON**.
Al centro del game loop vi è un terminale interattivo che evolve nel tempo.

1. **Gestione del Panico (Game Loop):** Il terminale muta; i log delle operazioni di cifratura appaiono in background forzando ritmi incalzanti.
2. **Ricognizione Gerarchica (`pstree`):** Scrutare l'albero processi (non solo una piatta lista) per capire dove un rootkit o loader si nasconde.
3. **Triage Veloce (`netscan`, `malfind`):** Filtrare connessioni malevole e regioni di memoria RWX introdotte dinamicamente.
4. **Estrazione e Chirurgia (`yarascan`, `memdump <pid>`, `kill <pid>`):** Estrarre sezioni di memoria per stringhe sospette (chiavi AES), e fermare proattivamente il malware operando sulla RAM.

## 💻 Architettura e Tecnologie
Il gioco è progettato per girare interamente lato client (nel browser) in modo da essere facilmente distribuito, senza necessità di macchine virtuali o backend pesanti:
- **Frontend:** HTML5, CSS Vanilla (tema terminale "cyberpunk/hacker") e Javascript puro.
- **Motore Dati:** Nessun motore gestionale complesso; lo scenario risiede in un grafo/struttura JSON statica (che mappa i processi ei loro attributi), manipolata progressivamente dallo stato di avanzamento del giocatore.
- **Impiego di AI Generativa:** Come concordato, l'impalcatura tecnica, la GUI del terminale e i parser dei comandi sono generati utilizzando AI Generative, assicurando che lo sforzo e l'attenzione dello sviluppatore (lo studente) siano posti rigorosamente sul contenuto educativo e il flow forense, piuttosto che sulle complicazioni di programmazione web.

## 📜 Vincoli di Progetto Approvati
In accordo con le regole stabilite dal docente:
- **Individuale:** Completamente sviluppato in autonomia.
- **Originalità:** V.O.I.D. offre un'esperienza distinta che non copia materiale già esistente o presente in altri tool didattici (come *CyberForensics-Arena*), focalizzandosi intimamente sull'interazione realistica da riga di comando per l'analisi volatile.

---

*Progetto didattico realizzato da Andrea Botticella (s347291).*
