import _ from "lodash";
import { parseNumberEN, firstUrlSegment, uuidv4 } from "./util";

describe("Util", () => {
  it("uuidv4() generates UUIDs", () => {
    const a = uuidv4();
    const b = uuidv4();
    expect(a).not.toEqual(b);
    expect(a.length).toEqual(36);
  });

  it("parseNumberEN()", () => {
    expect(parseNumberEN("+123,4.56z")).toEqual(1234.56);
    expect(parseNumberEN("-500.123")).toEqual(-500.123);
  });
  it("firstUrlSegment()", () => {
    expect(
      firstUrlSegment("https://www.google.com/foo/bar/baz?param=5")
    ).toEqual("foo");
    expect(firstUrlSegment("https://www.google.com/")).toEqual("no-name");
  });
});
