const SingleEliminationTournament = require('./SingleElimination');

class TournamentFactory {
    static create(tournamentId, options) {
        switch (options.tournament_type) {
            case 'single_elimination':
                return new SingleEliminationTournament(tournamentId, options);
            //someone else can work on the round robin and stuff
            default:
                throw new Error(`Unsupported tournament type: ${options.tournament_type}`);
        }
    }
}

module.exports = TournamentFactory;
