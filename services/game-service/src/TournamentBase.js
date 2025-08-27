class TournamentBase {
    constructor(tournamentId, options = {}) {
        this.tournamentId = tournamentId;
        this.options = options;
        this.participants = [];
        this.currentRound = 0;
        this.status = 'registration';
    }

    async addParticipant(userId) {
        throw new Error('addParticipant must be implemented by subclass');
    }

    async startTournament() {
        throw new Error('startTournament must be implemented by subclass');
    }

    async advanceRound() {
        throw new Error('advanceRound must be implemented by subclass');
    }

    async recordMatchResult(matchId, winnerId) {
        throw new Error('recordMatchResult must be implemented by subclass');
    }

    getBracket() {
        throw new Error('getBracket must be implemented by subclass');
    }
}

module.exports = TournamentBase;
