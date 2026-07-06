import SavedList from "../components/SavedList";
import { listFavorites } from "../lib/social";

export default function Favorites() {
  return <SavedList title="즐겨찾기" load={listFavorites} emptyText="즐겨찾기한 장소가 없어요." />;
}
