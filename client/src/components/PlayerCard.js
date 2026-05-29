import getMediaUrl from "../utils/mediaUrl";

function PlayerCard({ player }) {
  return (
    <div className="player-card-main">
      <div className="mini-avatar">
        {player.profile_photo ? (
          <img
            src={getMediaUrl(player.profile_photo)}
            alt={player.name || "Joueur"}
            loading="lazy"
          />
        ) : (
          <span>{(player.name || "J").charAt(0)}</span>
        )}
      </div>
      <div>
        <h4>{player.name}</h4>
        <p>
          {player.position || "Poste inconnu"} - {player.city || "Ville inconnue"}
        </p>
        <p>Rôle club : {player.club_role || "Joueur"}</p>
        <p>Club actuel : {player.team_name || "Aucun"}</p>
      </div>
    </div>
  );
}

export default PlayerCard;
