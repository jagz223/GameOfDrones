import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DroneApiService, KillPair, MoveRule, PlayerStat } from '../services/drone-api.service';

type Phase = 'intro' | 'names' | 'play' | 'gameover' | 'rules';

interface RoundRow {
  round: number;
  label: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly api = inject(DroneApiService);

  phase: Phase = 'intro';
  loading = false;
  error: string | null = null;

  rules: MoveRule[] = [];
  moveOptions: string[] = [];
  stats: PlayerStat[] = [];

  player1Name = '';
  player2Name = '';

  round = 1;
  p1Wins = 0;
  p2Wins = 0;
  roundRows: RoundRow[] = [];
  pendingP1: string | null = null;
  currentMove = '';

  winnerName: string | null = null;

  rulesDraft: KillPair[] = [];
  newKiller = '';
  newDefeated = '';

  ngOnInit(): void {
    this.refreshRules();
    this.refreshStats();
  }

  refreshRules(): void {
    this.api.getRules().subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.moveOptions = this.buildMoveOptions(r.rules);
        if (this.moveOptions.length > 0 && !this.currentMove) {
          this.currentMove = this.moveOptions[0];
        }
      },
      error: () => this.setError('No se pudieron cargar las reglas del servidor.'),
    });
  }

  refreshStats(): void {
    this.api.getStats().subscribe({
      next: (s) => (this.stats = s),
      error: () => {},
    });
  }

  startFlow(): void {
    this.phase = 'names';
    this.clearError();
  }

  beginMatch(): void {
    if (this.moveOptions.length === 0) {
      this.setError('No hay movimientos disponibles. Revisa la conexión con la API o las reglas.');
      return;
    }
    const a = this.player1Name.trim();
    const b = this.player2Name.trim();
    if (!a || !b) {
      this.setError('Escribe el nombre de ambos jugadores.');
      return;
    }
    if (a.toLowerCase() === b.toLowerCase()) {
      this.setError('Los nombres deben ser distintos.');
      return;
    }
    this.round = 1;
    this.p1Wins = 0;
    this.p2Wins = 0;
    this.roundRows = [];
    this.pendingP1 = null;
    this.pickDefaultMove();
    this.phase = 'play';
    this.clearError();
  }

  confirmMove(): void {
    if (!this.currentMove) {
      this.setError('Selecciona un movimiento.');
      return;
    }
    if (this.pendingP1 === null) {
      this.pendingP1 = this.currentMove;
      this.pickDefaultMove();
      return;
    }

    const p1 = this.pendingP1;
    const p2 = this.currentMove;
    this.pendingP1 = null;

    const outcome = this.evaluateRound(p1, p2);
    let label: string;
    if (outcome === 'p1') {
      this.p1Wins++;
      label = this.player1Name.trim();
    } else if (outcome === 'p2') {
      this.p2Wins++;
      label = this.player2Name.trim();
    } else if (outcome === 'tie') {
      label = 'Empate';
    } else {
      label = 'Sin ganador (reglas)';
    }

    this.roundRows = [...this.roundRows, { round: this.round, label }];

    if (this.p1Wins >= 3 || this.p2Wins >= 3) {
      this.winnerName = this.p1Wins >= 3 ? this.player1Name.trim() : this.player2Name.trim();
      this.phase = 'gameover';
      this.loading = true;
      this.api.recordGameWon(this.winnerName).subscribe({
        next: () => {
          this.loading = false;
          this.refreshStats();
        },
        error: () => {
          this.loading = false;
          this.setError('No se pudo guardar el resultado en el servidor.');
        },
      });
      return;
    }

    this.round++;
    this.pickDefaultMove();
  }

  playAgain(): void {
    this.winnerName = null;
    this.player1Name = '';
    this.player2Name = '';
    this.phase = 'names';
    this.clearError();
  }

  openRules(): void {
    this.rulesDraft = this.rulesFromServer();
    this.newKiller = '';
    this.newDefeated = '';
    this.phase = 'rules';
    this.clearError();
  }

  backFromRules(): void {
    this.phase = 'gameover';
    this.clearError();
  }

  addRuleRow(): void {
    const k = this.newKiller.trim();
    const d = this.newDefeated.trim();
    if (!k || !d) {
      this.setError('Indica movimiento ganador y movimiento derrotado.');
      return;
    }
    if (k.toLowerCase() === d.toLowerCase()) {
      this.setError('Un movimiento no puede derrotarse a sí mismo.');
      return;
    }
    this.rulesDraft = [...this.rulesDraft, { killer: k, defeated: d }];
    this.newKiller = '';
    this.newDefeated = '';
    this.clearError();
  }

  removeRuleRow(i: number): void {
    this.rulesDraft = this.rulesDraft.filter((_, idx) => idx !== i);
  }

  saveRules(): void {
    if (this.rulesDraft.length === 0) {
      this.setError('Añade al menos una regla.');
      return;
    }
    this.loading = true;
    this.api.replaceRules({ rules: this.rulesDraft }).subscribe({
      next: (r) => {
        this.rules = r.rules;
        this.moveOptions = this.buildMoveOptions(r.rules);
        this.pickDefaultMove();
        this.loading = false;
        this.phase = 'gameover';
        this.clearError();
      },
      error: () => {
        this.loading = false;
        this.setError('No se pudieron guardar las reglas.');
      },
    });
  }

  currentPlayerLabel(): string {
    return this.pendingP1 === null ? this.player1Name.trim() : this.player2Name.trim();
  }

  private rulesFromServer(): KillPair[] {
    return this.rules.map((x) => ({ killer: x.moveName, defeated: x.kills }));
  }

  private buildMoveOptions(list: MoveRule[]): string[] {
    const set = new Set<string>();
    for (const r of list) {
      set.add(r.moveName);
      set.add(r.kills);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }

  private pickDefaultMove(): void {
    if (this.moveOptions.length === 0) {
      this.currentMove = '';
      return;
    }
    if (!this.moveOptions.includes(this.currentMove)) {
      this.currentMove = this.moveOptions[0];
    }
  }

  private evaluateRound(p1Move: string, p2Move: string): 'p1' | 'p2' | 'tie' | 'none' {
    if (p1Move === p2Move) {
      return 'tie';
    }
    const killerToVictim = new Map<string, string>();
    for (const r of this.rules) {
      killerToVictim.set(r.moveName, r.kills);
    }
    const p1Beats = killerToVictim.get(p1Move);
    const p2Beats = killerToVictim.get(p2Move);
    if (p1Beats === p2Move && p2Beats === p1Move) {
      return 'none';
    }
    if (p1Beats === p2Move) {
      return 'p1';
    }
    if (p2Beats === p1Move) {
      return 'p2';
    }
    return 'none';
  }

  private setError(msg: string): void {
    this.error = msg;
  }

  private clearError(): void {
    this.error = null;
  }
}
