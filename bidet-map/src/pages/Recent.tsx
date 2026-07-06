import SavedList from "../components/SavedList";
import { listRecentViews } from "../lib/social";

export default function Recent() {
  return <SavedList title="최근 본 장소" load={listRecentViews} emptyText="최근 본 장소가 없어요." />;
}
