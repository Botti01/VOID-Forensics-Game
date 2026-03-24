# V.O.I.D. (Volatile Output Investigation & Discovery)
**Struttura e Scheletro del Serious Game**

## 1. Concept e Ambientazione
- **Genere:** Simulatore CLI (Command-Line Interface) investigativo, accessibile via browser.
- **Scenario:** Un Ransomware (es. *WannaCry* o *Ryuk* simulato) sta cifrando i file di un server critico aziendale. Il server è isolato dalla rete ma ancora acceso. Il giocatore ha accesso solo a un terminale che esegue un dump della memoria RAM in tempo reale.
- **Obiettivo:** Trovare il processo malevolo nascosto in memoria, estrarre la chiave di decifrazione AES e terminare il processo prima dello scadere del tempo.

## 2. Meccaniche di Gioco (Core Gameplay)
A differenza delle classiche indagini post-mortem statiche, V.O.I.D. si focalizza sul **Live Incident Response sotto pressione**.
Il gioco si basa su input testuali CLI e output simulati (JSON) che ricalcano l'output di veri tool Sysinternals e Volatility-like, operando in *real-time*.

**Flusso Dinamico e Azioni del giocatore:**
- **Game Timer e Pressione:** Mentre l'utente indaga, a intervalli regolari appaiono a schermo log rossi di sistema (es. `"ERROR: File /corporate_data/finance.db encrypted..."`). Il giocatore ha un tempo vitale limitato.
1. **Ricognizione Gerarchica (`pstree`):** A differenza della semplice `pslist`, l'analista deve tracciare attivamente la catena Padre-Figlio per capire l'origine dell'infezione (es. un processo malevolo che fa *Hollowing* di `svchost.exe`).
2. **Isolamento Connessioni (`netstat` / `netscan`):** Per tracciare storici di traffico malevolo verso indirizzi di Comando e Controllo (C2).
3. **Analisi della Memoria Dinamica (`malfind` / `sigscan`):** Cerca segmenti di memoria allocata con permessi RWX o firme sospette ignorate dagli EDR.
4. **Acquisizione e Remediation (`memdump`, `yarascan`, `kill`):** Il giocatore estrae il dump del processo infetto per recuperare la *chiave AES* in esadecimale e chiude forzatamente la catena di processi (es. `kill -f <PID>`) prima che il server sia compromesso al 100%. All'interno della memoria dovrà anche de-offuscare la chiave.

## 3. UI / UX Design
- **Interfaccia:** Una finta finestra di terminale a schermo intero (stile hacker/cyberpunk, testi verdi su fondo nero o tema scuro stile Kali Linux).
- **Feedback:** Suoni di digitazione tastiera meccanica, messaggi di allerta rossi per i file cifrati in background (per mettere pressione).
- **Aiuti:** Un comando `help` o `hint` che, simulando un "Manuale dell'Investigatore", spiega i concetti teorici (es. cos'è un VAD, come funziona l'Order of Volatility) al costo di penalità di tempo.

## 4. Architettura Tecnica (Sviluppo assistito da AI)
- **Frontend:** HTML5, CSS Vanilla e JavaScript puro (o React se si preferisce una state management più solida).
- **Backend:** Nessuno. Tutto logico lato client.
- **Dati:** Un grafo JSON statico che rappresenta lo stato della RAM (lista processi, porte logiche), facilmente manipolabile e aggiornabile dal "Domain Expert" (tu).
- **Ruolo dell'AI (Generative AI):** L'AI (es. Claude o Gemini) scriverà il 100% dell'interfaccia grafica del terminale, l'engine di parsing dei comandi e la logica di update dello schermo, permettendo allo studente di focalizzarsi solo sulle regole forensi vere e proprie.

## 5. Learning Outcomes (Validazione per il Professore)
- Dimostrare praticamente l'**Order of Volatility** (l'evidenza decade se la macchina viene spenta).
- Insegnare le logiche base della **Memory Forensics** (VAD, Handle, PID/PPID tree).
- Educare sul riconoscimento delle tecniche di **Process Hollowing** o Injection comuni nei malware.

## 6. Approvazione e Vincoli del Professore (da Email)
- **Valutazione:** L'attività permette di ottenere da 0 a 4 punti aggiuntivi all'esame.
- **Formato:** Progetto da svolgere in modalità strettamente individuale.
- **Metodologia:** È confermato e incoraggiato l'uso di AI Generativa per lo sviluppo del codice base (es. interfaccia grafica e motore del terminale), affinché il focus formativo resti unicamente sui concetti forensi.
- **Vincoli di Originalità:** Assoluto divieto di replicare scenari già presenti in *CyberForensics-Arena* o in altri giochi online. *V.O.I.D. si differenzia nettamente garantendo un focus profondo ed esclusivo sulla Memory Forensics interattiva via CLI, rendendolo un modulo unico e non sovrapposto ad altri.*
