import challengeUtils = require('../lib/challengeUtils');
import { type Request, type Response, type NextFunction } from 'express';
import * as db from '../data/mongodb';
import { challenges } from '../data/datacache';
const security = require('../lib/insecurity');

module.exports = function productReviews () {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers['authorization']?.split(' ')[1]; // vuln-code-snippet vuln-line forgedReviewChallenge

    // Check if user is authenticated (prevents anonymous review changes)
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decoded = jwt.verify(token, 'your-secret-key'); // Ensure the token is valid using your secret key
    const user = security.authenticatedUsers.get(token); // Retrieve the user based on the token

    if (!user || user.data.email !== decoded.email) {
      return res.status(403).json({ error: 'Forbidden' }); // Check if the user matches the decoded token
    }

    // Grab the reviewId and reviewMessage from the request body
    const reviewId = req.body.id;
    const reviewMessage = req.body.message;

    // Define a type for the review
    interface Review {
      _id: string;
      author: string;
      message: string;
    }

    // Find the review in the database
    db.reviewsCollection.findOne({ _id: reviewId })
      .then((review: Review | null) => {
        if (!review || typeof review.author !== 'string' || review.author !== user.data.email) {
          // User is not authorized to edit the review (check if the user is the author)
          return res.status(403).json({ error: 'Forbidden' });
        }

        // At this point, it is OK to update the review
        return db.reviewsCollection.update(
          { _id: reviewId, author: user.data.email }, // Only allow updates if the review's author matches the current user
          { $set: { message: reviewMessage } }, // Only allow the message field to be updated, not the author
          { multi: false } // Ensure only one document is updated
        ).then((result: { modified: number, original: Array<{ author: string }> }) => {
          if (!result.original || result.original.length === 0) {
            return res.status(500).json({ error: 'Failed to retrieve the original review' });
          }

          // Solve the challenges if certain conditions are met
          challengeUtils.solveIf(challenges.noSqlReviewsChallenge, () => result.modified > 1);
          challengeUtils.solveIf(challenges.forgedReviewChallenge, () => user?.data && review.author !== user.data.email && result.modified == 1);

          res.json(result);
        });
      })
      .catch((err: Error) => {
        // Handle other potential errors like connection issues
        console.error('Error fetching review:', err);
        res.status(500).json({ error: 'Failed to fetch review' });
      });
  };
};
