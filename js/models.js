"use strict";

const BASE_URL = "https://hack-or-snooze-v3.herokuapp.com";

/******************************************************************************
 * Story: a single story in the system
 */

class Story {
  /** Make instance of Story from data object about story:
   *   - {title, author, url, username, storyId, createdAt}
   */

  constructor({ storyId, title, author, url, username, createdAt }) {
    this.storyId = storyId;
    this.title = title;
    this.author = author;
    this.url = url;
    this.username = username;
    this.createdAt = createdAt;
  }

  /** Parses hostname out of URL and returns it. */

  getHostName() {
    // UNIMPLEMENTED: complete this function!
    return new URL(this.url).host;
  }
}

/******************************************************************************
 * List of Story instances: used by UI to show story lists in DOM.
 */

class StoryList {
  constructor(stories) {
    this.stories = stories;
  }

  /** Generate a new StoryList. It:
   *
   *  - calls the API
   *  - builds an array of Story instances
   *  - makes a single StoryList instance out of that
   *  - returns the StoryList instance.
   */

  static async getStories() {
    // Note presence of `static` keyword: this indicates that getStories is
    //  **not** an instance method. Rather, it is a method that is called on the
    //  class directly. Why doesn't it make sense for getStories to be an
    //  instance method?

    // query the /stories endpoint (no auth required)
    const response = await axios({
      url: `${BASE_URL}/stories`,
      method: "GET",
    });

    // turn plain old story objects from API into instances of Story class
    const stories = response.data.stories.map((story) => new Story(story));

    // build an instance of our own class using the new array of stories
    return new StoryList(stories);
  }

  /** Adds story data to API, makes a Story instance, adds it to story list.
   * - user - the current instance of User who will post the story
   * - obj of {title, author, url}
   *
   * Returns the new Story instance
   */
  // ************** PART 2 SUBPART 2A *****************************************
  async addStory(user, { title, author, url }) {
    // Make the POST request to the API to add a new story
    if (!user || !user.loginToken) {
      throw new Error("User is not logged in or login token is missing");
    }
    const token = user.loginToken;
    const response = await axios({
      url: `${BASE_URL}/stories`,
      method: "POST",
      data: { token, story: { title, author, url } },
    });

    // Extract the story data from the response
    const story = new Story(response.data.story);
    this.stories.unshift(story);
    user.ownStories.unshift(story);
    // Return the new Story instance
    return story;
  }

  // 4.2 Delete a story from API and Remove from the story lists

  // user: the current User Instance
  //  storyId: the ID of the story you want to remove

  async removeStory(user, storyId) {
    const token = user.loginToken;
    await axios({
      url: `${BASE_URL}/stories/${storyId}`,
      method: "DELETE",
      data: { token: user.loginToken },
    });
    // filter out the story whose ID we are removing
    this.story = this.stories.filter((story) => story.storyId !== storyId);

    // do the same thing for the user's list of stories & their favorites
    user.ownStories = user.ownStories.filter((s) => s.storyId !== storyId);
    user.favorites = user.favorites.filter((s) => s.storyId !== storyId);
  }
}

/******************************************************************************
 * User: a user in the system (only used to represent the current user)
 */

class User {
  /** Make user instance from obj of user data and a token:
   *   - {username, name, createdAt, favorites[], ownStories[]}
   *   - token
   */

  constructor(
    { username, name, createdAt, favorites = [], ownStories = [] },
    token
  ) {
    this.username = username;
    this.name = name;
    this.createdAt = createdAt;

    // instantiate Story instances for the user's favorites and ownStories
    this.favorites = favorites.map((s) => new Story(s));
    this.ownStories = ownStories.map((s) => new Story(s));

    // store the login token on the user so it's easy to find for API calls.
    this.loginToken = token;
  }

  /** Register new user in API, make User instance & return it.
   *
   * - username: a new username
   * - password: a new password
   * - name: the user's full name
   */

  static async signup(username, password, name) {
    const response = await axios({
      url: `${BASE_URL}/signup`,
      method: "POST",
      data: { user: { username, password, name } },
    });

    let { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories,
      },
      response.data.token
    );
  }

  /** Login in user with API, make User instance & return it.

   * - username: an existing user's username
   * - password: an existing user's password
   */

  static async login(username, password) {
    const response = await axios({
      url: `${BASE_URL}/login`,
      method: "POST",
      data: { user: { username, password } },
    });

    let { user } = response.data;

    return new User(
      {
        username: user.username,
        name: user.name,
        createdAt: user.createdAt,
        favorites: user.favorites,
        ownStories: user.stories,
      },
      response.data.token
    );
  }

  /** When we already have credentials (token & username) for a user,
   *   we can log them in automatically. This function does that.
   */

  static async loginViaStoredCredentials(token, username) {
    try {
      const response = await axios({
        url: `${BASE_URL}/users/${username}`,
        method: "GET",
        params: { token },
      });

      let { user } = response.data;

      return new User(
        {
          username: user.username,
          name: user.name,
          createdAt: user.createdAt,
          favorites: user.favorites,
          ownStories: user.stories,
        },
        token
      );
    } catch (err) {
      console.error("loginViaStoredCredentials failed", err);
      return null;
    }
  }
  // 3A.2
  // add story to the list of user favorites and update the API
  async addFavorite(story) {
    this.favorites.push(story);
    await this._addOrRemoveFavorite("add", story);
  }
  // 3A.3
  // Remove a story to the list of user favorites and update the API

  async removeFavorite(story) {
    this.favorites = this.favorites.filter((s) => s.storyId !== story.storyId);
    await this._addOrRemoveFavorite("remove", story);
  }

  // 3A.1
  /** Update API with favorite/not-favorite.
   *   - newState: "add" or "remove"
   *   - story: Story instance to make favorite / not favorite
   * */

  async _addOrRemoveFavorite(newState, story) {
    const method = newState === "add" ? "POST" : "DELETE";
    const token = this.loginToken;
    await axios({
      url: `${BASE_URL}/users/${this.username}/favorites/${story.storyId}`,
      method: method,
      data: { token },
    });
  }

  // 3A.4
  // Return true/false if given Story instance is a favorite of this user.

  isFavorite(story) {
    return this.favorites.some((s) => s.storyId === story.storyId);
  }
}
