import { expect, test } from "bun:test";
import { Container, inject } from "@akujs/aku";

test("PodcastController intro", () => {
  class Controller {}
  class AppleMusic {}

  // BEGIN
  class PodcastController extends Controller {
    constructor(private apple = inject(AppleMusic)) {
      super();
    }

    /**
     * Show information about the given podcast.
     */
    public async process(id: string) {
      return id + String(this.apple);
      // TODO when we've implemented templates and view controllers, come back to make this real
    }
  }
  // END

  expect(PodcastController).not.toBe(null);
  expect(Container).not.toBe(null);
});
