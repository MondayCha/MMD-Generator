"""
https://codereview.stackexchange.com/questions/90194/multiple-longest-common-subsequence-another-algorithm
"""
import bisect
from api.models.coordinate import Coordinate


def mlcs(arrays):
    """
    Return a long common subsequence of the strings.
    Uses a greedy algorithm, so the result is not necessarily the
    longest common subsequence.
    """
    if not arrays:
        raise ValueError("mlcs() argument is an empty sequence")
    alphabet = set.intersection(*(set(array) for array in arrays))
    print(alphabet)

    # indexes[letter][i] is list of indexes of letter in arrays[i].
    indexes = {coordinate: [[] for _ in arrays] for coordinate in alphabet}
    for i, array in enumerate(arrays):
        for j, coordinate in enumerate(array):
            if coordinate in alphabet:
                indexes[coordinate][i].append(j)

    print(indexes)
    # pos[i] is current position of search in strings[i].
    pos = [len(array) for array in arrays]

    # Generate candidate positions for next step in search.
    def candidates():
        for letter, letter_indexes in indexes.items():
            # print("letter: %s, letter_indexes: %s" % (letter, letter_indexes))
            distance, candidate = 0, []
            for ind, p in zip(letter_indexes, pos):
                i = bisect.bisect_right(ind, p - 1) - 1
                q = ind[i]
                if i < 0 or q > p - 1:
                    break
                candidate.append(q)
                distance += (p - q)**2
            else:
                print("distance: %s, letter: %s, candidate: %s" %
                      (distance, letter, candidate))
                yield distance, letter, candidate

    result = []
    while True:
        try:
            # Choose the closest candidate position, if any.
            _, letter, pos = min(candidates())
        except ValueError:
            return list(reversed(result))
        result.append('(%s %s)' % (letter, pos))


if __name__ == "__main__":
    print(
        mlcs([
            [
                Coordinate('1', '2'),
                Coordinate('1', '3'),
                Coordinate('1', '4'),
                Coordinate('1', '3'),
                Coordinate('1', '3'),
                Coordinate('2', '2')],
            [
                Coordinate('1', '2'),
                Coordinate('2', '2'),
                Coordinate('1', '3'),
                Coordinate('1', '3'),
                Coordinate('1', '3')],
            [
                Coordinate('2', '4'),
                Coordinate('1', '2'),
                Coordinate('1', '3'),
                Coordinate('1', '3'),
                Coordinate('1', '3'),
                Coordinate('2', '2')],
            [
                Coordinate('2', '2'),
                Coordinate('1', '2'),
                Coordinate('1', '4'),
                Coordinate('2', '2'),
                Coordinate('1', '3'),
                Coordinate('1', '3'),
                Coordinate('2', '2'),
                Coordinate('1', '2'),
                Coordinate('1', '3'),
                Coordinate('2', '2'),
                Coordinate('1', '3')]
        ])
    )
